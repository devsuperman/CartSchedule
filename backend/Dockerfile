FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restaura dependências primeiro para aproveitar o cache de camadas
COPY src/CartSchedule.Api/CartSchedule.Api.csproj src/CartSchedule.Api/
RUN dotnet restore src/CartSchedule.Api/CartSchedule.Api.csproj

COPY src/ src/
RUN dotnet publish src/CartSchedule.Api/CartSchedule.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "CartSchedule.Api.dll"]
