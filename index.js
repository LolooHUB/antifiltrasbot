const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { db } = require('./firebase');
const fs = require('node:fs');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

client.commands = new Collection();
const ROL_TICKETS = '1433603806003990560'; // Tu Rol de Tickets actualizado
const CANAL_TICKETS_ID = '1433599187324502016'; // Asegúrate de que este sea el ID de tu canal TICKETS

// Carga de Comandos
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const cmd = require(`./commands/${file}`);
    client.commands.set(cmd.data.name, cmd);
}

client.once('ready', async () => {
    console.log(`Bot conectado como ${client.user.tag}`);
    const channel = client.channels.cache.get(CANAL_TICKETS_ID);
    if (channel) {
        const messages = await channel.messages.fetch({ limit: 50 });
        const botMsgs = messages.filter(m => m.author.id === client.user.id);
        if (botMsgs.size > 0) await channel.bulkDelete(botMsgs).catch(() => null);

        const embed = new EmbedBuilder()
            .setTitle("📩 Reportar Filtrador")
            .setDescription("Haz clic abajo para abrir un ticket de reporte.")
            .setColor("#ff0000");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_ticket').setLabel('Abrir Reporte').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ embeds: [embed], components: [row] });
    }
});

client.on('interactionCreate', async i => {
    if (i.isChatInputCommand()) {
        const command = client.commands.get(i.commandName);
        if (command) await command.execute(i);
    }

    if (i.isButton() && i.customId === 'btn_ticket') {
        const modal = new ModalBuilder().setCustomId('mdl_reporte').setTitle('Reportar Filtrador');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('u').setLabel('Usuario Reportado').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e').setLabel('Evidencia (Texto)').setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('o').setLabel('Info Extra').setStyle(TextInputStyle.Paragraph).setRequired(false))
        );
        await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'mdl_reporte') {
        const userRep = i.fields.getTextInputValue('u');
        const txtEv = i.fields.getTextInputValue('e');
        const extra = i.fields.getTextInputValue('o') || 'N/A';

        // CREACIÓN DE CANAL PRIVADO (Corrección de permisos)
        const ch = await i.guild.channels.create({
            name: `reporte-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: i.guild.id, // @everyone
                    deny: [PermissionFlagsBits.ViewChannel], // BLOQUEO TOTAL INICIAL
                },
                {
                    id: i.user.id, // Usuario creador
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
                },
                {
                    id: ROL_TICKETS, // Rol Staff Tickets
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                }
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle("🛡️ Nuevo Ticket de Reporte")
            .addFields(
                { name: "👤 Reportado", value: userRep },
                { name: "📄 Evidencia", value: txtEv },
                { name: "➕ Extra", value: extra }
            )
            .setColor("Blue")
            .setFooter({ text: "Sube tus imágenes/videos aquí." });

        await ch.send({ content: `<@${i.user.id}> <@&${ROL_TICKETS}>`, embeds: [embed] });
        await i.reply({ content: `Ticket abierto en ${ch}`, ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
