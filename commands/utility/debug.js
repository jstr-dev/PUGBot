const { SlashCommandBuilder } = require('discord.js');
const queue = require('../../queue.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('debug')
		.setDescription('debug'),

	async execute(interaction) {
		console.log('Current queues', queue.queues);
		await interaction.reply('Hey!');
	},
};