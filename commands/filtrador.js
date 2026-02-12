const { 
    Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, 
    TextInputStyle, ChannelType, PermissionFlagsBits 
} = require('discord.js');
const { db } = require('./firebase');
const fs = require('node:fs');

const client = new Client({ intents: [3276799] });

const ROL_TICKETS = '1433602012163080293';
const CANAL_TICKETS_ID = '1412420238284423208';

client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const cmd = require(`./commands/${file}`);
    client.commands.set(cmd.data.name, cmd);
}

// Evento Ready actualizado
client.once('clientReady', async () => {
    console.log(`✅ ${client.user.tag} ONLINE`);
    const channel = client.channels.cache.get(CANAL_TICKETS_ID);
    if (!channel) return;

    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => new Map());
    const botMessages = messages.filter(m => m.author.id === client.user.id);
    if (botMessages.size > 0) await channel.bulkDelete(botMessages).catch(() => null);

    const embed = new EmbedBuilder()
        .setTitle("🛡️ ANTI-FILTRAS | CENTRO DE AYUDA")
        .setDescription("Si tienes pruebas de alguien filtrando contenido, repórtalo aquí.")
        .addFields({ name: "❗ Importante", value: "Adjunta fotos y videos dentro del ticket." })
        .setColor("#1a1a1a")
        .setThumbnail(client.user.displayAvatarURL());

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_ticket').setLabel('ABRIR REPORTE').setStyle(ButtonStyle.Danger).setEmoji('📩')
    );

    await channel.send({ embeds: [embed], components: [row] });
});

client.on('interactionCreate', async (i) => {
    if (i.isChatInputCommand()) {
        const command = client.commands.get(i.commandName);
        if (command) await command.execute(i);
    }

    if (i.isButton() && i.customId === 'btn_ticket') {
        const modal = new ModalBuilder().setCustomId('mdl_reporte').setTitle('FORMULARIO DE REPORTE');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('u').setLabel("USER / ID").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e').setLabel("DETALLES (TEXTO)").setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === 'mdl_reporte') {
        const target = i.fields.getTextInputValue('u');
        const ev = i.fields.getTextInputValue('e');

        const ticket = await i.guild.channels.create({
            name: `🎫-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                { id: ROL_TICKETS, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const emb = new EmbedBuilder()
            .setAuthor({ name: "NUEVO REPORTE", iconURL: i.guild.iconURL() })
            .setColor("#ff0000")
            .addFields(
                { name: "👤 Sospechoso", value: `\`${target}\``, inline: true },
                { name: "📝 Detalles", value: `\`\`\`${ev}\`\`\`` }
            )
            .setFooter({ text: "Sube aquí las imágenes/videos de evidencia." });

        await ticket.send({ content: `<@${i.user.id}> <@&${ROL_TICKETS}>`, embeds: [emb] });
        await i.reply({ content: `✅ Ticket creado: ${ticket}`, ephemeral: true });
    }
});

client.login(process.env.BOT_TOKEN);
