const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const api = require('../../api.js');
const queue = require('../../queue.js');
const generateErrorEmbed = require('../../utils/generateError.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a player from a queue.')
        .addUserOption(option => option.setName('player').setDescription('The player to kick.').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    translatedCodes: {
        'PLAYER_NOT_FOUND': 'The player you\'re trying to kick does not exist.',
        'PLAYER_NOT_IN_QUEUE': 'The player you\'re trying to kick is not in any queue.',
    },

    async execute(interaction) {
        let user = interaction.options.getUser('player');

        try {
            const res = await api.post('/internal/queue/kick', {
                discord_id: user.id,
            });

            await user.send({ content: 'You have been kicked from a queue by a moderator.', ephemeral: true });
            await interaction.reply({ content: 'Player has been kicked.', ephemeral: true });
            queue.lastUpdate[res.data.id] = user.displayName + ' has been kicked';
            await queue.update(res.data);
        } catch (error) {
            if (!error.response.data || !this.translatedCodes[error.response.data.code]) {
                return await generateErrorEmbed(interaction, 'An unknown error has occured, please contact the admin team.');
            }

            return await generateErrorEmbed(interaction, this.translatedCodes[error.response.data.code]);
        }
    },
};