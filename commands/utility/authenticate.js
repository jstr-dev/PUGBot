const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
require('dotenv').config();
const crypto = require('crypto');
const api = require('../../api.js');
const generateErrorEmbed = require('../../utils/generateError.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('authenticate')
		.setDescription('Authenticate your account with Steam.'),

	async execute(interaction) {
        const userId = interaction.user.id;
        const timestamp = Math.floor(Date.now() / 1000);
        const sign = this.generateSignature(userId, timestamp);
        
        if (await this.isAuthenticated(userId)) {
            await generateErrorEmbed(interaction, 'You are already authenticated with Steam.');
            return;
        }

        const linkButton = new ButtonBuilder()
            .setURL(`${process.env.API_URL}/steam/auth?discord_id=${userId}&timestamp=${timestamp}&signature=${sign}`)
            .setLabel('Authenticate with Steam')
            .setStyle(ButtonStyle.Link);

        const row = new ActionRowBuilder()
			.addComponents(linkButton);

		await interaction.reply({
            content: 'To play PUGs you must first authenticate with Steam so we can accurately track your participation in games.',
			components: [row],
            flags: MessageFlags.Ephemeral
		});
    }, 

    async isAuthenticated(userId) {
        return api.get(`internal/user/authenticated?discord_id=${userId}`).then(response => {
            return response.data.authenticated;
        }).catch(error => {
            console.error(error);
            return false;
        });
    },

    generateSignature(userId, timestamp) {
        const signature = `${userId}-${timestamp}`.trim();
        return crypto.createHmac('sha256', process.env.SHARED_SECRET).update(signature).digest('hex');
    }
};