using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CartSchedule.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SolicitacaoDataEspecial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "DataEspecial",
                table: "solicitacoes",
                type: "date",
                nullable: true);

            // Pedidos já existentes ficam no grupo que o carrinho tinha até agora (regra 10a).
            migrationBuilder.Sql("""
                UPDATE solicitacoes s
                SET "DataEspecial" = c."DataEspecial"
                FROM carrinhos c
                WHERE c."Id" = s."CarrinhoId";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DataEspecial",
                table: "solicitacoes");
        }
    }
}
