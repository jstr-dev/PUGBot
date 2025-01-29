const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('hey')
		.setDescription('Replies with Hey!'),
	async execute(interaction) {
		await interaction.reply('Hey!');
	},
};