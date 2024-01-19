// app.js
const express = require('express');
const app = express();

app.use(express.json());

// Define the port for your Express app
const PORT = 4040;

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


  
module.exports = app;
