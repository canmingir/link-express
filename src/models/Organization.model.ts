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
}

export default Organization;
