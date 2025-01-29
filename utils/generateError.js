const { EmbedBuilder, MessageFlags } = require('discord.js');

async function generateErrorEmbed(interaction, message) {
    const errorEmbed = new EmbedBuilder()
        .setTitle('Error')
        .setDescription(message)
        .setColor(0xff0000); // Red color for error

    await interaction.reply({
        embeds: [errorEmbed],
        flag: MessageFlags.Ephemeral
    });
}

module.exports = generateErrorEmbed;
