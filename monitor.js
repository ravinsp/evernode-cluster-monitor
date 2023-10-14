const HotPocket = require('hotpocket-js-client');
const fs = require('fs');
const jsonic = require('jsonic');
const process = require('process');

// nodes file must contain cluster create output from evdevkit.
const nodesFile = process.argv.splice(2)[0] || 'nodes.json';
// using jsonic since hpdevkit output is not properly json formatted.
const nodes = jsonic(fs.readFileSync(nodesFile).toString());

async function app() {

    HotPocket.setLogLevel(2); // hide internal logs.

    const userKeys = await HotPocket.generateKeys();
    const pkhex = Buffer.from(userKeys.publicKey).toString('hex');
    console.log('My public key is: ' + pkhex);

    nodes.forEach(n => {
        n.url = `wss://${n.domain}:${n.user_port}`;
        if (n.url.length > urlMaxLength)
            urlMaxLength = n.url.length;
    });

    // start monitoring each node.
    nodes.forEach(n => {
        connectToHotPocket(n.url, n.host, n.pubkey, n.contract_id, userKeys);
    });
}

app();

let currentLedgerSeqNo = 0;
let urlMaxLength = 0;

async function connectToHotPocket(url, hostAddr, serverPublicKey, contractId, userKeys) {

    const hpc = await HotPocket.createClient(
        [url],
        userKeys,
        {
            contractId: contractId,
            trustedServerKeys: [serverPublicKey],
            protocol: HotPocket.protocols.json,
        }
    );

    // Establish HotPocket connection.
    if (!await hpc.connect()) {
        console.log(nodeLog(url), 'Connection failed.', hostAddr);
        return;
    }

    const stat = await hpc.getStatus();
    console.log(nodeLog(url), 'roundtime:', stat.roundTime, 'voteStatus:', stat.voteStatus);

    // This will get fired when any ledger event occurs (ledger created, sync status change).
    hpc.on(HotPocket.events.ledgerEvent, (ev) => {

        if (ev?.ledger?.seqNo) {
            if (currentLedgerSeqNo < ev.ledger.seqNo) {
                currentLedgerSeqNo = ev.ledger.seqNo
                console.log('-----------------');
            }

            console.log(nodeLog(url), ev.ledger.seqNo);
        }
        else {
            console.log(nodeLog(url), ev);
        }
    })
    await hpc.subscribe(HotPocket.notificationChannels.ledgerEvent);
}

function nodeLog(url) {
    return url.padEnd(urlMaxLength + 1, ' ');
}