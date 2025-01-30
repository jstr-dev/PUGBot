const { ActionRowBuilder } = require('@discordjs/builders');
const api = require('./api');
const { EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const generateErrorEmbed = require('./utils/generateError.js');
require('dotenv').config();

module.exports = {
    queues: {},
    messages: {},
    lastUpdate: {},
    client: null,
    guild: null,
    translatedCodes: {
        'PLAYER_NOT_FOUND': 'You must authenticate your account first using /authenticate.',
        'QUEUE_FULL': 'The queue is full, please try again later.',
        'PLAYER_ALREADY_IN_QUEUE': 'You are already in the queue.',
        'PLAYER_ALREADY_IN_ANOTHER_QUEUE': 'You are already in another queue.',
        'PLAYER_NOT_IN_QUEUE': 'You are not in the queue.',
    },

    generatePlayerListMessage: async function (players) {
        for (let player of players) {
            let member = await this.guild.members.fetch(player.discord_id);
            if (member) {
                player.name = member.nickname;
            }
        }

        if (players.length < 8) {
            dummy = [];

            for (i = 0; i < 8 - players.length; i++) {
                dummy.push({ name: '', dummy: true });
            }

            players = [...players, ...dummy];
        }

        return players.map((player, index) => {
            return `**${index + 1}:** ${player.name}`;
        }).join('\n');
    },

    updateMessage: async function (queue) {
        const message = await this.generateMessage(queue);
        const channel = await this.client.channels.fetch(queue.discord_channel_id);

        if (!this.messages[queue.id]) {
            this.messages[queue.id] = await channel.send(message);
        } else {
            await this.messages[queue.id].edit(message);
        }
    },

    generateMessage: async function (queue) {
        const embed = new EmbedBuilder()
            .setTitle(queue.name + ' Queue (2/8)')
            .setColor(0x0099FF)
            .setDescription(queue.description)
            .setFields(
                { name: '\u2009', value: '\u2009' },
                { name: 'Current Players', value: await this.generatePlayerListMessage(queue.players) },
                { name: '\u2009', value: '\u2009' },
            )
            .setFooter({ text: 'Last update: ' + (this.lastUpdate[queue.id] ?? 'N/A') });

        const join = new ButtonBuilder()
            .setCustomId('queue-join-' + queue.id)
            .setLabel('Join')
            .setStyle(ButtonStyle.Success);

        const leave = new ButtonBuilder()
            .setCustomId('queue-leave-' + queue.id)
            .setLabel('Leave')
            .setStyle(ButtonStyle.Danger);

        const actionRow = new ActionRowBuilder()
            .addComponents(join, leave);

        return { embeds: [embed], components: [actionRow] };
    },

    processButton: async function (interaction, args) {
        switch (args[0]) {
            case 'join':
                await this.updatePlayer(args[1], true, interaction);
                break;
            case 'leave':
                await this.updatePlayer(args[1], false, interaction);
                break;
        }
    },

    updatePlayer: async function (queueId, isJoin, interaction) {
        let uri = '/internal/queue/' + queueId + '/' + (isJoin ? 'join' : 'leave');

        try {
            const response = await api.post(uri, {
                discord_id: interaction.user.id,
            });

            this.lastUpdate[queueId] = interaction.member.nickname + ' ' + (isJoin ? 'joined' : 'left') + ' the queue.';
            this.queues[queueId] = response.data;
            this.updateMessage(this.queues[queueId]);
        } catch (response) {
            if (!response.response || !response.response.data || !this.translatedCodes[response.response.data.code]) {
                console.error(response);
                return await generateErrorEmbed(interaction, 'An unknown error has occured, please contact the admin team.');
            }

            return await generateErrorEmbed(interaction, this.translatedCodes[response.response.data.code]);
        }
    },

    register: async function (queue) {
        messageId = await this.updateMessage(queue);
        this.queues[queue.id] = queue;
    },

    init: async function (client) {
        this.client = client;

        let guilds = await client.guilds.fetch();

        if (!guilds.get(process.env.DISCORD_GUILD_ID)) {
            console.error('Guild not found.');
            return;
        };

        this.guild = await guilds.get(process.env.DISCORD_GUILD_ID).fetch();

        console.log('Fetching queue information.');
        api.get('internal/queues').then(response => {
            for (queue of response.data) {
                this.register(queue);
            }

            console.log('Queue information found, ready.');
        }).catch(error => {
            console.error(error);
        });
    }
}