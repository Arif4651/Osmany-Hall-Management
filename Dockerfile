FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

COPY . .

RUN dotnet restore HallBackend.csproj
RUN dotnet publish HallBackend.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview
WORKDIR /app

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "HallBackend.dll"]