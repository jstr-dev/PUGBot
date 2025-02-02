const axios = require('axios');
require('dotenv').config();

const api = axios.create({
    baseURL: process.env.API_URL + '/api',
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${process.env.API_TOKEN}`,
    },
});

api.interceptors.response.use(
    response => response,  // pass through successful responses
    error => {
        if (error.response && error.response.status === 503) {
            console.log('Service Unavailable (503)');
            // Handle the 503 error, e.g., show a message, retry request, etc.
        }

        return error;
    }
);

module.exports = api;