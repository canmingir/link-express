import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  PrimaryKey,
  AllowNull,
  BelongsTo,
  HasMany,
  ForeignKey,
} from "sequelize-typescript";
import Organization from "./Organization.model";
import Permission from "./Permission.model";

@Table({
  tableName: "Project",
  timestamps: false,
  underscored: true,
})
class Project extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare icon: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare description: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare type: string | null;

  @AllowNull(true)
  @ForeignKey(() => Organization)
  @Column(DataType.UUID)
  declare organizationId: string | null;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare coach: string | null;

  @BelongsTo(() => Organization)
  declare organization?: Organization;

  @HasMany(() => Permission)
  declare permissions?: Permission[];
}

export default Project;
