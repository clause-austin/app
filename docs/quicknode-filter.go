// QuickNode Streams Go filter — Solana devnet, dataset "block".
// Keeps only transactions that touch the Clause escrow wallet and emits them in the
// shape /api/webhooks/quicknode understands. Returns nil (no delivery) otherwise.

const escrow = "8MPShtxFArpofKJercHnYSfP3o1Xb8MSSbrguAyMqDTE"

type Payload struct {
    Data     []SolanaBlock          `json:"data"`
    Metadata map[string]interface{} `json:"metadata"`
}

type SolanaBlock struct {
    ParentSlot   int64      `json:"parentSlot"`
    Transactions []SolanaTx `json:"transactions"`
}

type SolanaTx struct {
    Meta struct {
        Err             interface{} `json:"err"`
        LogMessages     []string    `json:"logMessages"`
        LoadedAddresses struct {
            Writable []string `json:"writable"`
            Readonly []string `json:"readonly"`
        } `json:"loadedAddresses"`
    } `json:"meta"`
    Transaction struct {
        Signatures []string `json:"signatures"`
        Message    struct {
            AccountKeys []struct {
                Pubkey string `json:"pubkey"`
            } `json:"accountKeys"`
        } `json:"message"`
    } `json:"transaction"`
}

type Out struct {
    Slot        int64    `json:"slot"`
    Transaction OutTx    `json:"transaction"`
    Meta        OutMeta  `json:"meta"`
}
type OutTx struct {
    Signatures []string `json:"signatures"`
}
type OutMeta struct {
    LogMessages []string    `json:"logMessages"`
    Err         interface{} `json:"err"`
}

func touches(tx SolanaTx) bool {
    for _, k := range tx.Transaction.Message.AccountKeys {
        if k.Pubkey == escrow {
            return true
        }
    }
    for _, k := range tx.Meta.LoadedAddresses.Writable {
        if k == escrow {
            return true
        }
    }
    for _, k := range tx.Meta.LoadedAddresses.Readonly {
        if k == escrow {
            return true
        }
    }
    return false
}

func Filter(qn *qn.QNContext, payload Payload) interface{} {
    var matched []Out
    for _, block := range payload.Data {
        for _, tx := range block.Transactions {
            if !touches(tx) {
                continue
            }
            matched = append(matched, Out{
                Slot:        block.ParentSlot + 1,
                Transaction: OutTx{Signatures: tx.Transaction.Signatures},
                Meta:        OutMeta{LogMessages: tx.Meta.LogMessages, Err: tx.Meta.Err},
            })
        }
    }
    if len(matched) == 0 {
        return nil
    }
    return map[string]interface{}{"matched": matched}
}
