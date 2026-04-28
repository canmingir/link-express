#!/usr/bin/env bun

const { Server } = require("socket.io");
const http = require("http");

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: "*" },
});

const subscriptions = {};

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("subscribe", (type) => {
    if (!subscriptions[type]) subscriptions[type] = new Set();
    subscriptions[type].add(socket.id);
    console.log(`Socket ${socket.id} subscribed to ${type}`);
  });

  socket.on("unsubscribe", (type) => {
    if (subscriptions[type]) {
      subscriptions[type].delete(socket.id);
      if (subscriptions[type].size === 0) delete subscriptions[type];
      console.log(`Socket ${socket.id} unsubscribed from ${type}`);
    }
  });

  socket.on("publish", ({ type, payload }) => {
    console.log(`Publish: ${type}`, payload);
    if (subscriptions[type]) {
      subscriptions[type].forEach((sid) => {
        io.to(sid).emit("event", { type, payload });
      });
    }
  });

  socket.on("disconnect", () => {
    Object.keys(subscriptions).forEach((type) => {
      subscriptions[type].delete(socket.id);
      if (subscriptions[type].size === 0) delete subscriptions[type];
    });
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Event server listening on port ${PORT}`);
});
