import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  PrimaryKey,
  AllowNull,
  HasMany,
  BeforeDestroy,
} from "sequelize-typescript";
import Permission from "./Permission.model";
import Project from "./Project.model";

@Table({
  tableName: "Organization",
  timestamps: false,
  underscored: true,
})
class Organization extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @HasMany(() => Permission)
  declare permissions?: Permission[];

  @HasMany(() => Project)
  declare projects?: Project[];

  @BeforeDestroy
  static async cascadeDelete(instance: Organization): Promise<void> {
    await Project.destroy({
      where: {
        organizationId: instance.id,
      },
    });
  }
}

export default Organization;
