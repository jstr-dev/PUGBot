const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const api = require('../../api.js');
const queue = require('../../queue.js');
const generateErrorEmbed = require('../../utils/generateError.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unsinbin')
        .setDescription('Unban a player from playing PUGs.')
        .addUserOption(option => option.setName('player').setDescription('The player to unban.').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    translatedCodes: {
        'PLAYER_NOT_BANNED': 'The player you\'re trying to ban is not banned.',
    },

    async execute(interaction) {
        let user = interaction.options.getUser('player');

        try {
            await api.post('/internal/queue/unban', {
                discord_id: user.id,
            });

            await user.send({ content: 'You have been unbanned from playing PUGs by a moderator.', ephemeral: true });

            let banEmbed = new EmbedBuilder()
                .setTitle('Player has been unbanned')
                .setColor(0x0099FF)
                .addFields(
                    { name: 'Player', value: '<@' + user.id + '>' },
                    { name: 'Admin', value: interaction.user.toString() },
                );

            await interaction.reply({ embeds: [banEmbed] });
        } catch (error) {
            console.log(error);

            if (!error.response.data || !this.translatedCodes[error.response.data.code]) {
                return await generateErrorEmbed(interaction, 'An unknown error has occured, please contact the admin team.');
            }

            return await generateErrorEmbed(interaction, this.translatedCodes[error.response.data.code]);
        }
    },
};