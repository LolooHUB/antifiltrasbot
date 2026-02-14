const { 
    Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, 
    PermissionFlagsBits, ActivityType 
} = require('discord.js');
const { db } = require('./firebase');

const client = new Client({ intents: [3276799] });

// --- CONFIGURACIÓN ---
const ROL_TICKETS = '1433603806003990560';
const CANAL_TICKETS_ID = '1433599187324502016';
const CANAL_BUGS_ID = '1471992338057527437';
const CANAL_STATUS_WEB = '1471651769565315072';
const CANAL_REPORTES_WEB = '1472251410166255696';
const CANAL_TRANSCRIPTS = '1433599228479148082';

client.once('ready', async () => {
    console.log(`✅ Anti-Filtras Pro: ${client.user.tag}`);
    client.user.setActivity('ᴀɴᴛɪ-ꜰɪʟᴛʀᴀꜱ ᴄᴏᴍᴍᴜɴɪᴛʏ', { type: ActivityType.Watching });

    // AUTO-ACTIVACIÓN: El bot se pone online en Firebase al iniciar
    await db.collection('BOT_CONTROL').doc('settings').update({ botEnabled: 1 }).catch(() => null);

    // --- MONITOR DE REPORTES WEB (ARREGLADO) ---
    db.collection('WEB_REPORTS').onSnapshot(snap => {
        snap.docChanges().forEach(async change => {
            if (change.type === 'added') {
                const data = change.doc.data();
                const chan = await client.channels.fetch(CANAL_REPORTES_WEB).catch(() => null);
                if (chan) {
                    const webEmb = new EmbedBuilder()
                        .setAuthor({ name: "NUEVO REPORTE EXTERNO (WEB)", iconURL: client.user.displayAvatarURL() })
                        .setColor(0x00ff88)
                        .addFields(
                            { name: "👤 Usuario ID", value: `\`${data.infractorID}\``, inline: true },
                            { name: "🔗 Evidencia", value: `[Ver Link](${data.evidenciaLink})`, inline: true },
                            { name: "📝 Detalles", value: `\`\`\`${data.comentario || "Sin descripción"}\`\`\`` }
                        )
                        .setFooter({ text: `ID: ${change.doc.id.slice(0,8)}` }).setTimestamp();
                    await chan.send({ content: `<@&${ROL_TICKETS}>`, embeds: [webEmb] });
                }
            }
        });
    });

    // --- MONITOR DE STATUS (6 ESTADOS) ---
    db.collection('BOT_CONTROL').doc('settings').onSnapshot(async (doc) => {
        const data = doc.data();
        if (!data) return;
        client.configGlobal = data;

        const statusChannel = await client.channels.fetch(CANAL_STATUS_WEB).catch(() => null);
        if (statusChannel) {
            const msgs = await statusChannel.messages.fetch({ limit: 10 });
            const botMsgs = msgs.filter(m => m.author.id === client.user.id);
            if (botMsgs.size > 0) await statusChannel.bulkDelete(botMsgs).catch(() => null);

            const getS = (v) => v === 1 ? "🟢 ` OPERATIVO `" : (v === 2 ? "🟡 ` MANTENIMIENTO `" : "🔴 ` DESACTIVADO `");
            const statusEmbed = new EmbedBuilder()
                .setTitle("🌐 Estado de Infraestructura")
                .setDescription(
                    `🤖 **BOT CORE:** ${getS(data.botEnabled)}\n` +
                    `🌐 **WEB:** ${getS(data.webEnabled)}\n` +
                    `📩 **SOPORTE:** ${getS(data.ticketsEnabled)}\n` +
                    `📡 **REPORTES WEB:** ${getS(data.webReportsEnabled)}\n` +
                    `⚙️ **CONFIG:** ${getS(data.configEnabled)}\n` +
                    `🚫 **BANEOS:** ${getS(data.bansEnabled)}`
                )
                .setColor(data.botEnabled === 1 ? 0x2b2d31 : 0xff3e3e)
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

    await renderPanel(CANAL_TICKETS_ID, "🛡️ Reportar Filtración", "### ¡Ayúdanos a proteger la comunidad!\nSi has visto contenido filtrado, cuéntanos aquí abajo.", "btn_ticket", "Abrir Reporte", "🛡️");
    await renderPanel(CANAL_BUGS_ID, "⚙️ Reporte de Errores", "### ¿Algo no funciona bien?\nInforma cualquier fallo técnico aquí.", "btn_bug", "Enviar Bug", "⚙️");
});

client.on('interactionCreate', async i => {
    if (i.isButton() && i.customId === 'close_ticket') {
        const logChan = await client.channels.fetch(CANAL_TRANSCRIPTS).catch(() => null);
        const msgs = await i.channel.messages.fetch();
        let transcript = `REGISTRO: ${i.channel.name}\n\n`;
        msgs.reverse().forEach(m => { transcript += `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}\n`; });
        if (logChan) {
            const file = Buffer.from(transcript, 'utf-8');
            await logChan.send({ content: `📂 Historial: **${i.channel.name}**`, files: [{ attachment: file, name: `${i.channel.name}.txt` }] });
        }
        return i.channel.delete();
    }

    if (i.isButton()) {
        if (client.configGlobal.ticketsEnabled === 0) return i.reply({ content: "❌ Sistema en mantenimiento.", ephemeral: true });
        const modal = new ModalBuilder().setCustomId(i.customId === 'btn_ticket' ? 'mdl_reporte' : 'mdl_bug').setTitle('Formulario');
        if (i.customId === 'btn_ticket') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('u').setLabel('ID del Infractor').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e').setLabel('Pruebas').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('o').setLabel('Nota').setStyle(TextInputStyle.Paragraph).setRequired(false))
            );
        } else {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bt').setLabel('Ubicación del error').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bd').setLabel('Descripción').setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        }
        await i.showModal(modal);
    }

    if (i.isModalSubmit()) {
        const isBug = i.customId === 'mdl_bug';
        await i.deferReply({ ephemeral: true });
        const ch = await i.guild.channels.create({
            name: `${isBug ? '🐛' : '🎫'}-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: ROL_TICKETS, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        // Solo hace el ping al usuario sin mensaje adicional de texto
        await ch.send(`<@${i.user.id}>`);

        const welcome = new EmbedBuilder()
            .setTitle(`Soporte Anti-Filtras`)
            .setDescription(`Nuestro equipo de <@&${ROL_TICKETS}> te atenderá pronto.\n\n**Por favor envía pruebas aquí mismo.**`)
            .setColor(0x2b2d31);
        
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Cerrar').setStyle(ButtonStyle.Danger).setEmoji('🔒'));
        await ch.send({ embeds: [welcome], components: [btn] });
        await i.editReply({ content: `✅ Canal: ${ch}` });
    }
});

client.login(process.env.BOT_TOKEN);
