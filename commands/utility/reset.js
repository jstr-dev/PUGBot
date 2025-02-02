const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const queue = require('../../queue.js');
const generateErrorEmbed = require('../../utils/generateError.js');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset')
        .setDescription('Reset a queue')
        .addStringOption(option => option.setName('queue').setDescription('The queue to reset.').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    translatedCodes: {
        'QUEUE_NOT_FOUND': 'That queue doesn\'t exist.',
    },

    async execute(interaction) {
        let queueId = interaction.options.getString('queue');

        if (!queue.queues[queueId]) {
            return await generateErrorEmbed(interaction, this.translatedCodes['QUEUE_NOT_FOUND']);
        }

        try {
            await queue.reset(queue.queues[queueId]);
            await interaction.reply({ content: 'Queue has been reset.', ephemeral: true });
        } catch (error) {
            if (!error.response.data || !this.translatedCodes[error.response.data.code]) {
                return await generateErrorEmbed(interaction, 'An unknown error has occured, please contact the admin team.');
            }

            return await generateErrorEmbed(interaction, this.translatedCodes[error.response.data.code]);
        }
    },
};