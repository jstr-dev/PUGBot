const { EmbedBuilder, MessageFlags } = require('discord.js');

// TODO: test whether this is actually private.
async function generateErrorEmbed(interaction, message) {
    const errorEmbed = new EmbedBuilder()
        .setTitle('Error')
        .setDescription(message)
        .setColor(0xff0000); // Red color for error

    await interaction.reply({
        embeds: [errorEmbed],
        ephemeral: true
    });
}

module.exports = generateErrorEmbed;
