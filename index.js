const { 
    Client, 
    GatewayIntentBits, 
    Collection, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ChannelType, 
    PermissionFlagsBits 
} = require('discord.js');
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

// CONFIGURACIÓN DE IDs
const ROL_TICKETS = '1433602012163080293';
const CANAL_TICKETS_ID = '1412420238284423208'; // ID ACTUALIZADO

client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const cmd = require(`./commands/${file}`);
    client.commands.set(cmd.data.name, cmd);
}

// --- PANEL DE TICKETS (READY) ---
client.once('ready', async () => {
    console.log(`✅ Bot online: ${client.user.tag}`);

    const channel = client.channels.cache.get(CANAL_TICKETS_ID);
    if (!channel) return console.error("❌ No encuentro el canal de tickets.");

    try {
        // Limpiar mensajes previos del bot
        const messages = await channel.messages.fetch({ limit: 50 }).catch(() => new Map());
        const botMessages = messages.filter(m => m.author.id === client.user.id);
        
        if (botMessages.size > 0) {
            await channel.bulkDelete(botMessages).catch(async () => {
                for (const m of botMessages.values()) await m.delete().catch(() => null);
            });
        }

        const embed = new EmbedBuilder()
            .setTitle("📩 Reportar Usuario / Filtrador")
            .setDescription("Si tienes pruebas de un usuario filtrador, abre un ticket con el botón de abajo.")
            .setColor("#ff0000");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_ticket')
                .setLabel('Abrir Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚠️')
        );

        await channel.send({ embeds: [embed], components: [row] });
        console.log("✅ Panel enviado al canal corregido.");
    } catch (err) {
        console.error("❌ Error enviando panel:", err);
    }
});

// --- INTERACCIONES ---
client.on('interactionCreate', async (i) => {
    if (i.isChatInputCommand()) {
        const command = client.commands.get(i.commandName);
        if (command) await command.execute(i);
    }

    if (i.isButton() && i.customId === 'btn_ticket') {
        const modal = new ModalBuilder().setCustomId('mdl_reporte').setTitle('Reporte');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('u').setLabel("Usuario").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e').setLabel("Evidencia (Texto)").setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('o').setLabel("Opcional").setStyle(TextInputStyle.Paragraph).setRequired(false))
        );
        await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'mdl_reporte') {
        const target = i.fields.getTextInputValue('u');
        const ev = i.fields.getTextInputValue('e');
        const opt = i.fields.getTextInputValue('o') || 'N/A';

        const ticket = await i.guild.channels.create({
            name: `reporte-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                { id: ROL_TICKETS, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const emb = new EmbedBuilder()
            .setTitle("🛡️ Nuevo Reporte")
            .addFields({name: "Reportado", value: target}, {name: "Texto", value: ev}, {name: "Extra", value: opt})
            .setColor("Blue");

        await ticket.send({ content: `<@${i.user.id}> <@&${ROL_TICKETS}>`, embeds: [emb] });
        await i.reply({ content: `Ticket: ${ticket}`, ephemeral: true });
    }
});

client.login(process.env.BOT_TOKEN);
