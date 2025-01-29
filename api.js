const axios = require('axios');
require('dotenv').config();

const axiosInstance = axios.create({
    baseURL: process.env.API_URL + '/api',
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${process.env.API_TOKEN}`,
    },
});

module.exports = axiosInstance;