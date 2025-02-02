const { SlashCommandBuilder } = require('discord.js');
const queue = require('../../queue.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queues')
        .setDescription('List all queues'),

    async execute(interaction) {
        let queues = [];
        for (let queueId in queue.queues) {
            queues.push(queue.queues[queueId].id);
        }
        return await interaction.reply({ content: 'The list of queues is: ' + queues.join(', '), ephemeral: true });
    },
};