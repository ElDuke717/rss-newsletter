const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
const app = express();

app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/feeds', require('./routes/feedRoutes'));
app.use('/api/subscribers', require('./routes/subscriberRoutes'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});