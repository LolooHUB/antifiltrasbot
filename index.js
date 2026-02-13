const { 
    Client, 
    Collection, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ChannelType, 
    PermissionFlagsBits, 
    ActivityType 
} = require('discord.js');
const { db } = require('./firebase');

const client = new Client({ intents: [3276799] });
client.configGlobal = { webEnabled: 1, ticketsEnabled: 1, bansEnabled: 1, configEnabled: 1 };

// --- CONFIGURACIÓN DE IDs ---
const ROL_TICKETS = '1433603806003990560';
const CANAL_TICKETS_ID = '1433599187324502016';
const CANAL_BUGS_ID = '1471992338057527437';
const CANAL_STATUS_WEB = '1471651769565315072';
const CANAL_TRANSCRIPTS = '1433599228479148082'; 

client.once('ready', async () => {
    console.log(`✅ Anti-Filtras Pro: ${client.user.tag}`);
    client.user.setActivity('ᴀɴᴛɪ-ꜰɪʟᴛʀᴀꜱ ᴄᴏᴍᴍᴜɴɪᴛʏ', { type: ActivityType.Watching });

    // --- MONITOR FIREBASE (ESTADO CON BORRADO Y RE-ENVÍO) ---
    db.collection('BOT_CONTROL').doc('settings').onSnapshot(async (doc) => {
        const data = doc.data();
        if (!data) return;
        
        const guild = client.guilds.cache.first();
        
        if (data.ticketsEnabled === 0 && client.configGlobal.ticketsEnabled !== 0) {
            const openTickets = guild.channels.cache.filter(c => (c.name.startsWith('🎫-') || c.name.startsWith('🐛-')) && c.type === ChannelType.GuildText);
            for (const [id, chan] of openTickets) {
                await chan.permissionOverwrites.edit(ROL_TICKETS, { SendMessages: false }).catch(() => null);
                chan.permissionOverwrites.cache.forEach(async (ov) => {
                    if (ov.id !== ROL_TICKETS && ov.id !== client.user.id && ov.id !== guild.id) {
                        await chan.permissionOverwrites.edit(ov.id, { SendMessages: false }).catch(() => null);
                    }
                });
                const pauseEmb = new EmbedBuilder()
                    .setTitle("✨ Pausa Técnica")
                    .setDescription(`\u200B\nHola. Estamos realizando unas mejoras en nuestro sistema de soporte. Por ahora, el chat ha sido pausado. ¡Volveremos muy pronto!\n\u200B`)
                    .setColor(0xff3e3e);
                await chan.send({ embeds: [pauseEmb] }).catch(() => null);
            }
        }
        client.configGlobal = data;

        const statusChannel = await client.channels.fetch(CANAL_STATUS_WEB).catch(() => null);
        if (statusChannel) {
            const msgs = await statusChannel.messages.fetch({ limit: 10 });
            const botMsgs = msgs.filter(m => m.author.id === client.user.id);
            if (botMsgs.size > 0) await statusChannel.bulkDelete(botMsgs).catch(() => null);

            const getStatus = (v) => v === 1 ? "🟢 ` OPERATIVO `" : (v === 2 ? "🟡 ` MANTENIMIENTO `" : "🔴 ` DESACTIVADO `");
            const statusEmbed = new EmbedBuilder()
                .setAuthor({ name: "Monitor de Sistemas", iconURL: client.user.displayAvatarURL() })
                .setDescription(`### Estado de la Infraestructura :\n\n🌐 **PÁGINA WEB:** ${getStatus(data.webEnabled)}\n📩 **SOPORTE:** ${getStatus(data.ticketsEnabled)}\n\n\u200B`)
                .setColor(data.webEnabled === 1 ? 0x2b2d31 : 0xff3e3e)
                .setFooter({ text: "Sincronizado en tiempo real" }).setTimestamp();
            
            await statusChannel.send({ embeds: [statusEmbed] });
        }
    });

    const renderPanel = async (id, tit, desc, bid, lab, em) => {
        const c = await client.channels.fetch(id).catch(() => null);
        if (!c) return;
        const ms = await c.messages.fetch({ limit: 10 });
        await c.bulkDelete(ms.filter(m => m.author.id === client.user.id)).catch(() => null);
        const emb = new EmbedBuilder().setAuthor({ name: "ᴀɴᴛɪ-ꜰɪʟᴛʀᴀꜱ ᴄᴏᴍᴍᴜɴɪᴛʏ" }).setTitle(tit).setDescription(`\u200B\n${desc}\n\u200B`).setColor(0x2b2d31);
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(bid).setLabel(lab).setStyle(ButtonStyle.Secondary).setEmoji(em));
        await c.send({ embeds: [emb], components: [row] });
    };

    await renderPanel(CANAL_TICKETS_ID, "🛡️ Reportar Filtración", "### ¡Ayúdanos a proteger la comunidad!\nSi has visto contenido filtrado o ventas ilegales, cuéntanos aquí abajo.", "btn_ticket", "Abrir Reporte", "🛡️");
    await renderPanel(CANAL_BUGS_ID, "⚙️ Reporte de Errores", "### ¿Algo no funciona bien?\nInforma cualquier fallo técnico para que nuestro equipo pueda arreglarlo.", "btn_bug", "Enviar Bug", "⚙️");
});

client.on('interactionCreate', async i => {
    if (i.isButton() && i.customId === 'close_ticket') {
        const logChan = await client.channels.fetch(CANAL_TRANSCRIPTS).catch(() => null);
        const msgs = await i.channel.messages.fetch();
        let transcript = `REGISTRO DE TICKET: ${i.channel.name}\n\n`;
        msgs.reverse().forEach(m => { transcript += `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}\n`; });

        if (logChan) {
            const file = Buffer.from(transcript, 'utf-8');
            await logChan.send({ content: `📂 Historial de conversación: **${i.channel.name}**`, files: [{ attachment: file, name: `${i.channel.name}.txt` }] });
        }
        return i.channel.delete();
    }

    if (i.isButton()) {
        if (client.configGlobal.ticketsEnabled === 0) return i.reply({ content: "❌ El sistema está en mantenimiento. Por favor, inténtalo más tarde.", ephemeral: true });
        const modal = new ModalBuilder().setCustomId(i.customId === 'btn_ticket' ? 'mdl_reporte' : 'mdl_bug').setTitle('Formulario de Ayuda');
        if (i.customId === 'btn_ticket') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('u').setLabel('ID del Infractor').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e').setLabel('Pruebas o Links').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('o').setLabel('¿Quieres añadir algo más?').setStyle(TextInputStyle.Paragraph).setRequired(false))
            );
        } else {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bt').setLabel('¿Dónde ocurre el fallo?').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bd').setLabel('Cuéntanos qué pasó').setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        }
        await i.showModal(modal);
    }

    if (i.isModalSubmit()) {
        const isBug = i.customId === 'mdl_bug';
        await i.deferReply({ ephemeral: true });
        const ch = await i.guild.channels.create({
            name: `${isBug ? '🐛-bug' : '🎫-reporte'}-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: ROL_TICKETS, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        // --- MENSAJE DE BIENVENIDA AMIGABLE ---
        const welcome = new EmbedBuilder()
            .setTitle(`¡Hola! Ya estamos aquí para ayudarte ✨`)
            .setDescription(
                `Bienvenido <@${i.user.id}> a tu canal de atención personalizada.\n\n` +
                `### 📸 ¿Nos podrías enviar las pruebas?\n` +
                `> Para poder ayudarte mejor, por favor **envía capturas de pantalla o videos** que muestren lo ocurrido.\n\n` +
                `Nuestro equipo de <@&${ROL_TICKETS}> revisará tu información lo antes posible. ¡Gracias por tu paciencia!`
            )
            .setColor(0x2b2d31)
            .setThumbnail(i.user.displayAvatarURL());

        const info = new EmbedBuilder()
            .setTitle(isBug ? "⚙️ Información del Bug" : "📄 Detalles del Reporte")
            .setColor(isBug ? 0xFFAA00 : 0x2b2d31)
            .setFooter({ text: "ᴀɴᴛɪ-ꜰɪʟᴛʀᴀꜱ ᴄᴏᴍᴍᴜɴɪᴛʏ" });

        if (isBug) {
            info.addFields(
                { name: "📍 Ubicación", value: `\`\`\`${i.fields.getTextInputValue('bt')}\`\`\``, inline: true },
                { name: "📝 Descripción", value: i.fields.getTextInputValue('bd') }
            );
        } else {
            info.addFields(
                { name: "👤 Usuario Reportado", value: `\`\`\`${i.fields.getTextInputValue('u')}\`\`\``, inline: true },
                { name: "🔗 Enlaces compartidos", value: i.fields.getTextInputValue('e') },
                { name: "💬 Nota adicional", value: `\`\`\`${i.fields.getTextInputValue('o') || 'Sin comentarios adicionales.'}\`\`\`` }
            );
        }

        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Finalizar Atención').setStyle(ButtonStyle.Danger).setEmoji('🔒'));
        
        await ch.send({ content: `Hola <@${i.user.id}>, el equipo de <@&${ROL_TICKETS}> ha sido notificado.`, embeds: [welcome, info], components: [btn] });
        await i.editReply({ content: `✨ ¡Listo! Tu canal ha sido creado con éxito: ${ch}` });
    }
});

client.login(process.env.BOT_TOKEN);
