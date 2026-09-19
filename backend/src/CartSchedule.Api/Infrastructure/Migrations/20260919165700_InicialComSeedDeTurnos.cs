using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace CartSchedule.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InicialComSeedDeTurnos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "carrinhos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nome = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_carrinhos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "escalas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MesReferencia = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_escalas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "publicadores",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Nome = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_publicadores", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "turnos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    HoraInicio = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    HoraFim = table.Column<TimeOnly>(type: "time without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_turnos", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "carrinho_turnos",
                columns: table => new
                {
                    CarrinhoId = table.Column<int>(type: "integer", nullable: false),
                    TurnoId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_carrinho_turnos", x => new { x.CarrinhoId, x.TurnoId });
                    table.ForeignKey(
                        name: "FK_carrinho_turnos_carrinhos_CarrinhoId",
                        column: x => x.CarrinhoId,
                        principalTable: "carrinhos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_carrinho_turnos_turnos_TurnoId",
                        column: x => x.TurnoId,
                        principalTable: "turnos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "solicitacoes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PublicadorId = table.Column<Guid>(type: "uuid", nullable: false),
                    EscalaId = table.Column<int>(type: "integer", nullable: false),
                    CarrinhoId = table.Column<int>(type: "integer", nullable: false),
                    DiaSemana = table.Column<int>(type: "integer", nullable: false),
                    TurnoId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Origem = table.Column<int>(type: "integer", nullable: false),
                    CriadoEm = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    DecididoEm = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_solicitacoes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_solicitacoes_carrinhos_CarrinhoId",
                        column: x => x.CarrinhoId,
                        principalTable: "carrinhos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_solicitacoes_escalas_EscalaId",
                        column: x => x.EscalaId,
                        principalTable: "escalas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_solicitacoes_publicadores_PublicadorId",
                        column: x => x.PublicadorId,
                        principalTable: "publicadores",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_solicitacoes_turnos_TurnoId",
                        column: x => x.TurnoId,
                        principalTable: "turnos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "turnos",
                columns: new[] { "Id", "HoraFim", "HoraInicio" },
                values: new object[,]
                {
                    { 1, new TimeOnly(8, 0, 0), new TimeOnly(6, 0, 0) },
                    { 2, new TimeOnly(10, 0, 0), new TimeOnly(8, 0, 0) },
                    { 3, new TimeOnly(12, 0, 0), new TimeOnly(10, 0, 0) },
                    { 4, new TimeOnly(16, 0, 0), new TimeOnly(14, 0, 0) },
                    { 5, new TimeOnly(18, 0, 0), new TimeOnly(16, 0, 0) },
                    { 6, new TimeOnly(20, 0, 0), new TimeOnly(18, 0, 0) }
                });

            migrationBuilder.CreateIndex(
                name: "IX_carrinho_turnos_TurnoId",
                table: "carrinho_turnos",
                column: "TurnoId");

            migrationBuilder.CreateIndex(
                name: "IX_escalas_MesReferencia",
                table: "escalas",
                column: "MesReferencia",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_solicitacoes_CarrinhoId",
                table: "solicitacoes",
                column: "CarrinhoId");

            migrationBuilder.CreateIndex(
                name: "IX_solicitacoes_EscalaId_CarrinhoId_DiaSemana_TurnoId",
                table: "solicitacoes",
                columns: new[] { "EscalaId", "CarrinhoId", "DiaSemana", "TurnoId" });

            migrationBuilder.CreateIndex(
                name: "IX_solicitacoes_PublicadorId_EscalaId_CarrinhoId_DiaSemana_Tur~",
                table: "solicitacoes",
                columns: new[] { "PublicadorId", "EscalaId", "CarrinhoId", "DiaSemana", "TurnoId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_solicitacoes_TurnoId",
                table: "solicitacoes",
                column: "TurnoId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "carrinho_turnos");

            migrationBuilder.DropTable(
                name: "solicitacoes");

            migrationBuilder.DropTable(
                name: "carrinhos");

            migrationBuilder.DropTable(
                name: "escalas");

            migrationBuilder.DropTable(
                name: "publicadores");

            migrationBuilder.DropTable(
                name: "turnos");
        }
    }
}
