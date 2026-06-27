const express = require("express");

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || "127.0.0.1";

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, host, (error) => {
  if (error) {
    console.error("Failed to start Sophia backend:", error.message);
    process.exit(1);
  }

  console.log(`Sophia backend listening at http://${host}:${port}`);
});
