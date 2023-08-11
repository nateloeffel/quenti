import { strip } from "@quenti/lib/strip";
import type { Widen } from "@quenti/lib/widen";
import { Prisma, type PrismaClient } from "@quenti/prisma/client";
import { TRPCError } from "@trpc/server";
import { getClassMember } from "../../lib/queries/classes";
import type { NonNullableUserContext } from "../../lib/types";
import type { TGetSchema } from "./get.schema";

type GetOptions = {
  ctx: NonNullableUserContext;
  input: TGetSchema;
};

const orgSelect = Prisma.validator<Prisma.OrganizationArgs>()({
  select: {
    id: true,
    domains: {
      select: {
        id: true,
        domain: true,
        type: true,
      },
    },
  },
});

const studySetsSelect = Prisma.validator<Prisma.Class$studySetsArgs>()({
  select: {
    studySet: {
      select: {
        id: true,
        title: true,
        visibility: true,
        user: {
          select: {
            id: true,
            username: true,
            image: true,
          },
        },
        _count: {
          select: {
            terms: true,
          },
        },
      },
    },
  },
});

const foldersSelect = Prisma.validator<Prisma.Class$foldersArgs>()({
  select: {
    folder: {
      select: {
        id: true,
        title: true,
        slug: true,
        user: {
          select: {
            id: true,
            username: true,
            image: true,
          },
        },
        _count: {
          select: {
            studySets: true,
          },
        },
      },
    },
  },
});

const sectionsSelect = Prisma.validator<Prisma.Class$sectionsArgs>()({
  select: {
    id: true,
    name: true,
    _count: {
      select: {
        students: true,
      },
    },
  },
});

const membersSelect = Prisma.validator<Prisma.Class$membersArgs>()({
  where: {
    type: "Teacher",
  },
  select: {
    id: true,
    user: {
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        image: true,
      },
    },
  },
});

const teacherInvitesSelect =
  Prisma.validator<Prisma.Class$teacherInvitesArgs>()({
    select: {
      id: true,
      email: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          image: true,
        },
      },
    },
  });

const getTeacher = async (id: string, prisma: PrismaClient) => {
  return await prisma.class.findUniqueOrThrow({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      description: true,
      organization: orgSelect,
      studySets: studySetsSelect,
      folders: foldersSelect,
      sections: sectionsSelect,
      members: membersSelect,
      teacherInvites: teacherInvitesSelect,
      _count: {
        select: {
          members: {
            where: {
              type: "Student",
            },
          },
        },
      },
    },
  });
};

const getStudent = async (id: string, prisma: PrismaClient) => {
  return await prisma.class.findUniqueOrThrow({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      description: true,
      studySets: studySetsSelect,
      folders: foldersSelect,
    },
  });
};

type AwaitedGetTeacher = Awaited<ReturnType<typeof getTeacher>>;
type AwaitedGetStudent = Awaited<ReturnType<typeof getStudent>>;
type Widened = Widen<AwaitedGetTeacher | AwaitedGetStudent>;

export const getHandler = async ({ ctx, input }: GetOptions) => {
  const member = await getClassMember(input.id, ctx.session.user.id);
  if (!member) throw new TRPCError({ code: "NOT_FOUND" });

  await ctx.prisma.classMembership.update({
    where: {
      id: member.id,
    },
    data: {
      viewedAt: new Date(),
    },
  });

  const class_ = (
    member.type === "Teacher"
      ? await getTeacher(input.id, ctx.prisma)
      : await getStudent(input.id, ctx.prisma)
  ) as Widened;

  return {
    id: class_.id,
    name: class_.name,
    description: class_.description,
    studySets: class_.studySets.map((s) => s.studySet),
    folders: class_.folders.map((f) => f.folder),
    ...strip({
      organization: class_.organization,
      teachers: class_.members,
      students: class_._count?.members,
      sections: class_.sections?.map((s) => ({
        id: s.id,
        name: s.name,
        students: s._count.students,
      })),
      teacherInvites: class_.teacherInvites,
    }),
    me: {
      id: member.id,
      type: member.type,
      sectionId: member.sectionId,
    },
  };
};

export default getHandler;
