const mediasoup = require("mediasoup");

let worker;

async function createWorker() {
  worker = await mediasoup.createWorker({
    rtcMinPort: 40000,
    rtcMaxPort: 49999
  });

  console.log("mediasoup worker created");

  worker.on("died", () => {
    console.error("mediasoup worker died");
    process.exit(1);
  });

  return worker;
}

module.exports = { createWorker };
