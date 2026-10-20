
require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
} = require("discord.js");

const commands = [
  // PANNEAUX
  new SlashCommandBuilder()
    .setName("adminpanel")
    .setDescription("Ouvrir le panneau d'administration de Neyvo"),

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Publier le panel de création de tickets"),

  // HELP
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Afficher toutes les commandes de Neyvo Ticket"),

  // OWNERS
  new SlashCommandBuilder()
    .setName("addowner")
    .setDescription("Ajouter un propriétaire à Neyvo")
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("Utilisateur à ajouter")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("removeowner")
    .setDescription("Retirer un propriétaire de Neyvo")
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("Utilisateur à retirer")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("listowners")
    .setDescription("Afficher les propriétaires de Neyvo"),

  // CONFIGURATION
  new SlashCommandBuilder()
    .setName("setstaffrole")
    .setDescription("Configurer le rôle du staff")
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("Rôle du staff")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("setlogchannel")
    .setDescription("Configurer le salon des logs")
    .addChannelOption((option) =>
      option
        .setName("salon")
        .setDescription("Salon textuel des logs")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  // CATÉGORIE DES TICKETS
  new SlashCommandBuilder()
    .setName("setticketcategory")
    .setDescription("Choisir la catégorie Discord des tickets")
    .addChannelOption((option) =>
      option
        .setName("categorie")
        .setDescription("Catégorie où créer les tickets")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    ),

  // GESTION DES TICKETS
  new SlashCommandBuilder()
    .setName("claim")
    .setDescription("Prendre en charge un ticket"),

  new SlashCommandBuilder()
    .setName("unclaim")
    .setDescription("Libérer la prise en charge d'un ticket"),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Fermer le ticket actuel"),

  new SlashCommandBuilder()
    .setName("rename")
    .setDescription("Renommer le ticket actuel")
    .addStringOption((option) =>
      option
        .setName("nom")
        .setDescription("Nouveau nom du ticket")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("adduser")
    .setDescription("Autoriser un utilisateur à voir le ticket")
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("Utilisateur à ajouter")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("removeuser")
    .setDescription("Retirer l'accès d'un utilisateur au ticket")
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("Utilisateur à retirer")
        .setRequired(true)
    ),

  // STATUT DU BOT
  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Modifier le statut en ligne de Neyvo")
    .addStringOption((option) =>
      option
        .setName("statut")
        .setDescription("Statut du bot")
        .setRequired(true)
        .addChoices(
          { name: "En ligne", value: "online" },
          { name: "Absent", value: "idle" },
          { name: "Ne pas déranger", value: "dnd" },
          { name: "Invisible", value: "invisible" }
        )
    ),

  new SlashCommandBuilder()
    .setName("stream")
    .setDescription("Mettre Neyvo en activité Streaming")
    .addStringOption((option) =>
      option
        .setName("texte")
        .setDescription("Texte de l'activité")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("lien")
        .setDescription("Lien HTTPS Twitch ou YouTube")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("activity")
    .setDescription("Modifier l'activité de Neyvo")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Type d'activité")
        .setRequired(true)
        .addChoices(
          { name: "Joue à", value: "Playing" },
          { name: "Écoute", value: "Listening" },
          { name: "Regarde", value: "Watching" },
          { name: "Participe à", value: "Competing" },
          { name: "Streaming", value: "Streaming" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("texte")
        .setDescription("Texte de l'activité")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("lien")
        .setDescription("Lien Twitch ou YouTube, obligatoire pour Streaming")
        .setRequired(false)
    ),
].map((command) => command.toJSON());

// Vérification des doublons
const names = commands.map((command) => command.name);
const duplicates = [
  ...new Set(
    names.filter((name, index) => names.indexOf(name) !== index)
  ),
];

if (duplicates.length > 0) {
  console.error("❌ Commandes en double :", duplicates.join(", "));
  process.exit(1);
}

async function main() {
  if (!process.env.TOKEN) {
    throw new Error("La variable TOKEN est absente du fichier .env.");
  }

  if (!process.env.CLIENT_ID) {
    throw new Error("La variable CLIENT_ID est absente du fichier .env.");
  }

  if (!process.env.GUILD_ID) {
    throw new Error("La variable GUILD_ID est absente du fichier .env.");
  }

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  console.log("🔄 Déploiement des commandes Neyvo...");

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  );

  console.log(`✅ ${commands.length} commandes déployées avec succès.`);
}

main().catch((error) => {
  console.error("❌ Erreur lors du déploiement :", error);
  process.exitCode = 1;
});
