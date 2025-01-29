const api = require('./api');

module.exports = {
    queues: [],

    initialMessage: function (queue) {
        
    },

    register: function (queue) {
        messageId = this.initialMessage(queue);

        this.queues.push(queue);
    },

    init: function () {
        console.log('Fetching queue information.');

        api.get('internal/queues').then(response => {
            for (queue of response.data) {
                this.register(queue);
            }
        }).catch(error => {
            console.error(error);
        });
    }
}