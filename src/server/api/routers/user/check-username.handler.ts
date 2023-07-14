import type { NonNullableUserContext } from "../../../lib/types";
import { usernameProfanity } from "../../common/profanity";
import type { TCheckUsernameSchema } from "./check-username.schema";

type CheckUsernameOptions = {
  ctx: NonNullableUserContext;
  input: TCheckUsernameSchema;
};

export const checkUsernameHandler = async ({
  ctx,
  input,
}: CheckUsernameOptions) => {
  if (usernameProfanity.exists(input.username)) {
    return {
      available: false,
      isProfane: true,
    };
  }

  const user = await ctx.prisma.user.findUnique({
    where: {
      username: input.username,
    },
  });

  return {
    available: user === null || user.id === ctx.session.user.id,
    isProfane: false,
  };
};

export default checkUsernameHandler;
