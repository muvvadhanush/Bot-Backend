const Connection = require("../models/Connection");

module.exports = async (req, res, next) => {
  const { connectionId } = req.body;

  if (!connectionId) {
    return res.status(400).json({ error: "Connection ID required" });
  }

  const connection = await Connection.findOne({ where: { connectionId } });

  if (!connection) {
    return res.status(404).json({ error: "Invalid Connection ID" });
  }

  req.connectionConfig = connection;
  next();
};
