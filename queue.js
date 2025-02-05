const { ActionRowBuilder } = require('@discordjs/builders');
const api = require('./api');
const { EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const generateErrorEmbed = require('./utils/generateError.js');
const { discordSort } = require('discord.js');
require('dotenv').config();

module.exports = {
    queues: {},
    messages: {},
    lastUpdate: {},
    client: null,
    guild: null,
    nameCache: {},
    rateLimits: {},
    hasSentPickingMessage: {},
    translatedCodes: {
        'PLAYER_NOT_FOUND': 'You must authenticate your account first using /authenticate.',
        'QUEUE_FULL': 'The queue is full, please try again later.',
        'PLAYER_ALREADY_IN_QUEUE': 'You are already in the queue.',
        'PLAYER_ALREADY_IN_ANOTHER_QUEUE': 'You are already in another queue.',
        'PLAYER_NOT_IN_QUEUE': 'You are not in the queue.',
        'QUEUE_IN_PROGRESS': 'You can\'t leave the queue once the picking process has begun.',
        'QUEUE_NOT_PICKING': 'The queue is not in the picking phase.',
        'PICKED_PLAYER_ALREADY_PICKED': 'This player has already been picked.',
        'PLAYER_NOT_CAPTAIN': 'Only captains can pick players.',
        'TEAM_NOT_PICKING': 'It\'s not your turn to pick.',
        'GAME_NOT_FOUND': 'The game you\'re trying to retrieve the password for does not exist.',
        'PLAYER_NOT_IN_GAME': 'You are not in the game you\'re trying to retrieve the password for.',
        'PLAYER_BANNED': 'You are banned from playing PUGs.',
        'LOBBY_LIMIT': 'We were unable to create a new Slapshot lobby, please try again later.',
    },

    getPlayerName: async function (player) {
        let name = player.name;

        if (this.nameCache[player.discord_id] && this.nameCache[player.discord_id].time > Date.now()) {
            return this.nameCache[player.discord_id].name;
        }

        try {
            let member = await this.guild.members.fetch(player.discord_id);

            if (member.displayName) {
                name = member.displayName;
            }
        } finally {
            this.nameCache[player.discord_id] = { name: name, time: Date.now() + 1000 * 60 * 24 };

            return name;
        }
    },

    generatePlayerListMessage: async function (players) {
        for (let player of players) {
            player.name = await this.getPlayerName(player) + ' (' + player.elo + ' elo)';
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

    update: async function (queue) {
        let message = null;

        switch (queue.state) {
            case 'waiting':
                message = await this.generateQueueMessage(queue);
                break;
            case 'picking':
                message = await this.generatePickingMessage(queue);

                if (!this.hasSentPickingMessage[queue.id]) {
                    let captains = queue.players.filter(player => player.is_captain);

                    for (let captain of captains) {
                        try {
                            await this.client.users.fetch(captain.discord_id).then(async (user) => {
                                await user.send({
                                    content: 'You\'re a captain in the ' + queue.name + ' queue, please select a player to join your team.',
                                });
                            });
                        } catch (error) { }

                        this.hasSentPickingMessage[queue.id] = true;
                    }
                }

                break;
            case 'finished':
                message = await this.generateFinishedMessage(queue);

                for (let player of queue.players) {
                    try {
                        await this.client.users.fetch(player.discord_id).then(async (user) => {
                        await user.send({
                            content: 'The queue has finished, please join the game.\n\n**Lobby Name:** ' + queue.game.name + '\n**Password:** ' + queue.game.password,
                        });
                    });
                    } catch (error) { }
                }

                break;
            default:
                throw new Error('Unknown queue state: ' + queue.state);
        }

        const channel = await this.client.channels.fetch(queue.discord_channel_id);

        if (!this.messages[queue.id]) {
            this.messages[queue.id] = await channel.send(message);
        } else {
            await this.messages[queue.id].edit(message);
        }

        if (queue.state === 'finished') {
            try {
                await this.reset(queue);
            } catch (error) {
                channel.send('An error has occured while resetting the queue, please contact the admin team.');
                console.error(error);
            }
        }
    },

    generateQueueMessage: async function (queue) {
        let embed = new EmbedBuilder()
            .setTitle(queue.name + ' Queue (' + queue.players.length + '/8)')
            .setColor(0x0099FF)
            .setDescription(queue.description)
            .setFields(
                { name: '\u2009', value: '\u2009' },
                { name: 'Current Players', value: await this.generatePlayerListMessage(queue.players) },
                { name: '\u2009', value: '\u2009' },
        );

        if (this.lastUpdate[queue.id]) {
            embed = embed.setFooter({ text: this.lastUpdate[queue.id] }).setTimestamp();
        }

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

    atMessage: function (player) {
        return '<@' + player.discord_id + '>';
    },

    getCurrentPickingPlayer: function (queue) {
        return queue.players.find((player) => {
            return (player.is_captain && player.team === queue.team_picking);
        });
    },

    generateTeamListMsgArr: async function (queue) {
        let maxPlayers = 8;
        console.log(queue);
        let homeTeamPlayers = queue.players.filter(player => player.team === 'home').sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at));
        let awayTeamPlayers = queue.players.filter(player => player.team === 'away').sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at));
        let homeMsg = '';
        let awayMsg = '';
        let homeTeamElo = 0;
        let awayTeamElo = 0;

        for (let i = 0; i < maxPlayers / 2; i++) {
            homeMsg += '**' + (i + 1) + ':** ';
            awayMsg += '**' + (i + 1) + ':** ';

            if (homeTeamPlayers[i]) {
                homeMsg += await this.getPlayerName(homeTeamPlayers[i]) + ' (' + homeTeamPlayers[i].elo + ' elo)';
                homeTeamElo += homeTeamPlayers[i].elo;
            }

            if (awayTeamPlayers[i]) {
                awayMsg += await this.getPlayerName(awayTeamPlayers[i]) + ' (' + awayTeamPlayers[i].elo + ' elo)';
                awayTeamElo += awayTeamPlayers[i].elo;
            }

            homeMsg += '\n';
            awayMsg += '\n';
        }

        homeTeamElo = Math.floor(homeTeamElo / homeTeamPlayers.length);
        awayTeamElo = Math.floor(awayTeamElo / awayTeamPlayers.length);

        return [
            { name: '🟥 Home Team (' + homeTeamElo + ' avg elo)', value: homeMsg, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '🟦 Away Team (' + awayTeamElo + ' avg elo)', value: awayMsg, inline: true },
        ];
    },

    generateFinishedMessage: async function (queue) {
        let embed = new EmbedBuilder()
            .setTitle(queue.name + ' Queue (Ready)⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀')
            .setColor(0x0099FF)
            .setDescription('It\'s time to play!')
            .addFields(
                { name: '\u2009', value: '\u2009' },
            )
            .addFields(
                { name: 'Lobby Name', value: queue.game.name },
                { name: '\u2009', value: '\u2009' },
                { name: 'Password', value: 'Press \"Reveal Password\" for the password.' },
                { name: '\u2009', value: '\u2009' },
            )
            .addFields(await this.generateTeamListMsgArr(queue));

        let RevealPassword = new ButtonBuilder()
            .setCustomId('queue-password-' + queue.game.id)
            .setLabel('Reveal Password')
            .setStyle(ButtonStyle.Success);

        const actionRow = new ActionRowBuilder()
            .addComponents(RevealPassword);

        return { embeds: [embed], components: [actionRow] };
    },

    generatePickingButtons: async function (queue) {
        let buttons = [];

        for (let player of queue.players) {
            if (player.team) continue;

            let button = new ButtonBuilder()
                .setCustomId('queue-pick-' + queue.id + '-' + player.id)
                .setLabel(await this.getPlayerName(player) + ' (' + player.elo + ' elo)')
                .setStyle(ButtonStyle.Primary);

            buttons.push(button);
        }

        return buttons;
    },

    generatePickingMessage: async function (queue) {
        let picking = this.getCurrentPickingPlayer(queue);
        let embed = new EmbedBuilder()
            .setTitle(queue.name + ' Queue (Picking)⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀')
            .setColor(0x0099FF)
            .setDescription(this.atMessage(picking) + ' it\'s your turn to pick!\u200B\u200B')
            .addFields(
                { name: '\u2009', value: '\u2009' },
            )
            .addFields(await this.generateTeamListMsgArr(queue));
        let buttons = await this.generatePickingButtons(queue);
        let components = [];
        let half = Math.ceil(buttons.length / 2);

        for (let i = 0; i < buttons.length; i += half) {
            components.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + half)));
        }

        return { embeds: [embed], components: components };
    },

    processButton: async function (interaction, args) {
        if (this.rateLimits[interaction.user.id] && this.rateLimits[interaction.user.id] > Date.now()) {
            return await generateErrorEmbed(interaction, 'Stop spamming!');
        }

        switch (args[0]) {
            case 'join':
                await this.updatePlayer(args[1], true, interaction);
                break;
            case 'leave':
                await this.updatePlayer(args[1], false, interaction);
                break;
            case 'pick':
                await this.pickPlayer(args[1], args[2], interaction);
                break;
            case 'password':
                await this.revealPassword(args[1], interaction);
                break;
        }

        this.rateLimits[interaction.user.id] = Date.now() + 1000;
    },

    revealPassword: async function (gameId, interaction) {
        try {
            const response = await api.get('/internal/game/' + gameId + '/password?discord_id=' + interaction.user.id);

            await interaction.reply({ content: 'The password is: ' + response.data.password, ephemeral: true });
        } catch (response) {
            if (!response.response || !response.response.data || !this.translatedCodes[response.response.data.code]) {
                console.error(response);
                return await generateErrorEmbed(interaction, 'An unknown error has occured, please contact the admin team.');
            }

            return await generateErrorEmbed(interaction, this.translatedCodes[response.response.data.code]);
        }
    },

    reset: async function (queue) {
        const response = await api.post('/internal/queue/' + queue.id + '/reset');

        this.queues[queue.id] = response.data;
        this.lastUpdate[queue.id] = null;
        this.messages[queue.id] = null;

        await this.update(response.data);
    },

    pickPlayer: async function (queueId, playerId, interaction) {
        try {
            const response = await api.post('/internal/queue/' + queueId + '/pick', {
                discord_id: interaction.user.id,
                queue_player_id: playerId,
            });

            console.log(response);

            this.queues[queueId] = response.data;
            await this.update(this.queues[queueId]);
        } catch (response) {
            if (!response.response || !response.response.data || !this.translatedCodes[response.response.data.code]) {
                console.error(response);
                return await generateErrorEmbed(interaction, 'An unknown error has occured, please contact the admin team.');
            }

            return await generateErrorEmbed(interaction, this.translatedCodes[response.response.data.code]);
        }
    },

    updatePlayer: async function (queueId, isJoin, interaction) {
        let uri = '/internal/queue/' + queueId + '/' + (isJoin ? 'join' : 'leave');

        try {
            const response = await api.post(uri, {
                discord_id: interaction.user.id,
            });

            this.lastUpdate[queueId] = (interaction.member.displayName) + ' ' + (isJoin ? 'joined' : 'left') + ' the queue';
            this.queues[queueId] = response.data;
            await this.update(this.queues[queueId]);
        } catch (error) {
            if (!error.response || !error.response.data || !this.translatedCodes[error.response.data.code]) {
                console.error(error);
                return await generateErrorEmbed(interaction, 'An unknown error has occured, please contact the admin team.');
            }

            return await generateErrorEmbed(interaction, this.translatedCodes[error.response.data.code]);
        }
    },

    register: async function (queue) {
        await this.update(queue);
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