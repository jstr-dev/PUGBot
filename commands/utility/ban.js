const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const api = require('../../api.js');
const queue = require('../../queue.js');
const generateErrorEmbed = require('../../utils/generateError.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sinbin')
        .setDescription('Ban a player from playing PUGs.')
        .addUserOption(option => option.setName('player').setDescription('The player to ban.').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('The reason for the ban.').setRequired(true))
        .addIntegerOption(option => option.setName('duration').setDescription('The duration of the ban (default: permanent)').setRequired(true))
        .addStringOption(option => option.setName('duration_type').setDescription('The type of duration (default: minutes)').setRequired(false).addChoices(
            { name: 'Minutes', value: 'minutes' },
            { name: 'Hours', value: 'hours' },
            { name: 'Days', value: 'days' },
        ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    translatedCodes: {
        'PLAYER_NOT_FOUND': 'The player you\'re trying to ban does not exist.',
        'PLAYER_ALREADY_BANNED': 'The player you\'re trying to ban is already banned.',
    },

    async execute(interaction) {
        let user = interaction.options.getUser('player');

        try {
            let now = Date.now() / 1000;
            let duration = interaction.options.getInteger('duration');
            let durationType = interaction.options.getString('duration_type');

            if (!durationType) {
                durationType = 'minutes';
            }

            if (durationType === 'minutes') {
                now += duration * 60;
            } else if (durationType === 'hours') {
                now += duration * 3600;
            } else if (durationType === 'days') {
                now += duration * 86400;
            }

            console.log(now);

            const res = await api.post('/internal/queue/ban', {
                discord_id: user.id,
                admin_discord_id: interaction.user.id,
                reason: interaction.options.getString('reason'),
                expires_at: now,
            });

            let ban = res.data.ban;
            let queue = res.data.queue;

            await user.send({ content: 'You have been banned from playing in the PUG queue.\nReason: ' + ban.reason + '\nExpires at: ' + ban.expires_at, ephemeral: true });

            let banEmbed = new EmbedBuilder()
                .setTitle('Player has been banned')
                .setColor(0x0099FF)
                .addFields(
                    { name: 'Player', value: '<@' + user.id + '>' },
                    { name: 'Reason', value: ban.reason },
                    { name: 'Admin', value: interaction.user.toString() },
                    { name: 'Expires At', value: ban.expires_at },
                );

            await interaction.reply({ embeds: [banEmbed] });

            if (queue) {
                queue.lastUpdate[queue.id] = user.displayName + ' has been banned';
                queue.queues[queue.id] = queue;
                await queue.update(queue.id);
            }
        } catch (error) {
            console.log(error);

            if (!error.response.data || !this.translatedCodes[error.response.data.code]) {
                return await generateErrorEmbed(interaction, 'An unknown error has occured, please contact the admin team.');
            }

            return await generateErrorEmbed(interaction, this.translatedCodes[error.response.data.code]);
        }
    },
};