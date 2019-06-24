require("dotenv").config();

process.on("unhandledRejection", (reason, p) => {
  console.error("Unhandled Rejection:", reason);
});

import { Container } from "@fullstack-one/di";
import { FullstackOneCore } from "fullstack-one";
import { ORM } from "@fullstack-one/db";
import { Auth } from "@fullstack-one/auth";
import { GraphQl } from "@fullstack-one/graphql";
import { AutoMigrate } from "@fullstack-one/auto-migrate";

const $one: FullstackOneCore = Container.get(FullstackOneCore);
const $orm: ORM = Container.get(ORM);
const $auth: Auth = Container.get(Auth);
const $gql: GraphQl = Container.get(GraphQl);
const $autoMigrate: AutoMigrate = Container.get(AutoMigrate);

$gql.addResolvers({
  someMutation: () => {
    return "Hello Mutation";
  },
  someQuery: () => {
    return "Hello query";
  }
});

import Photo from "./models/Photo";
import User from "./models/User";
import Task from "./models/Task";

(async () => {
  await $one.boot();

  console.log("### ORM");

  /*const queryRunner1 = $orm.createQueryRunner();
  await queryRunner1.connect();


  queryRunner1.startTransaction();
  const result = await queryRunner1.query(`SELECT * FROM "Photo";`);
  console.log(`result: ${JSON.stringify(result)}`);
  const result2 = await queryRunner1.query(`INSERT INTO public."Photo" (name) VALUES ('blub');`);
  console.log(`result2: ${JSON.stringify(result2)}`);
  const result3 = await queryRunner1.query(`SELECT * FROM "Photo";`);
  console.log(`result3: ${JSON.stringify(result3)}`);
  queryRunner1.commitTransaction();


  await queryRunner1.release(); */

  // const photo = new Photo();
  // photo.name = "Misha and the Bear";
  // await photo.save();
  // console.log("Photo has been saved");

  // const user = new User();
  // user.firstname = "David";
  // user.firstname = "Sparkles";
  // user.photo = photo;
  // await user.save();
  // console.log("User has been saved");

  // const task = new Task();
  // user.firstname = "David";
  // user.firstname = "Sparkles";
  // user.photo = photo;
  // await user.save();
  // console.log("User has been saved");

  /*const queryRunner = $orm.getConnection().createQueryRunner();
  await queryRunner.connect();

  const activities = await queryRunner.query("SELECT application_name FROM pg_stat_activity");
  console.log(`Activities: ${JSON.stringify(activities)}`);

  const photos = await Photo.find();
  console.log("Loaded photos: ", JSON.stringify(photos, null, 2));
  const users = await User.find();
  console.log("Loaded users: ", JSON.stringify(users, null, 2));
  const tasks = await Task.find();
  console.log("Loaded tasks: ", JSON.stringify(tasks, null, 2));*/

  // const task = tasks[0];
  // if (task != null) {
  //   console.log("Loaded task user: ", JSON.stringify(task.user, null, 2));
  //   console.log("Loaded task user with await: ", JSON.stringify(await task.user, null, 2));
  // }
})();
