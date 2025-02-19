import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { LunarAssistant } from "..";
import { RandomEarthAPIError, UserDocMissingError } from "../types/errors";

const lunarVerify = {
  data: new SlashCommandBuilder()
    .setName("lunar-view-roles")
    .setDescription(
      "View the roles that you have been granted based on the contents of your wallet."
    )
    .addBooleanOption((option) =>
      option
        .setName("private-response")
        .setDescription(
          "Indicate whether or not the response should be public or private. Public by default."
        )
    ),
  execute: async (
    lunarAssistant: LunarAssistant,
    interaction: CommandInteraction
  ) => {
    // verify the interaction is valid
    if (!interaction.guildId || !interaction.guild || !interaction.member)
      return;

    const rawPrivateResponse =
      interaction.options.getBoolean("private-response");
    const privateResponse = rawPrivateResponse ? rawPrivateResponse : false;

    try {
      const userActiveRoles = (
        await lunarAssistant.updateDiscordRolesForUser(interaction.user.id)
      ).activeRoles;

      if (Object.keys(userActiveRoles).length > 0) {
        const activeRolesMessage = Object.keys(userActiveRoles)
          .map(
            (guildName) =>
              `${guildName}: ${userActiveRoles[guildName].join(", ")}`
          )
          .join("\n");

        await interaction.reply({
          content: `You have been granted the following roles on the following servers:\n${activeRolesMessage}`,
          ephemeral: privateResponse,
        });
      } else {
        await interaction.reply({
          content: `You have not been granted any roles.`,
          ephemeral: privateResponse,
        });
      }
    } catch (e) {
      console.error(e);

      if (e instanceof UserDocMissingError) {
        await interaction.reply({
          content:
            "Cannot check for roles because you haven't linked a wallet yet. Please link a wallet with /lunar-link and try again.",
          ephemeral: true,
        });
      } else if (e instanceof RandomEarthAPIError) {
        await interaction.reply({
          content:
            "The bot is having trouble reading the RandomEarth listings, please try again later. Roles will be frozen until the bot can read RandomEarth listings again.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "There was an unknown error while executing this command!",
          ephemeral: true,
        });
      }
    }
  },
};

export default lunarVerify;
