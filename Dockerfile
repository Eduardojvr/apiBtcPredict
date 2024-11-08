# Use uma imagem base do Node.js
FROM node:10.4.0 as build-stage

# Defina o diretório de trabalho
WORKDIR /app

# Copie os arquivos de configuração de pacotes
COPY package*.json ./

# Instale as dependências
RUN npm install

# Copie todo o código para o container
COPY . .

# Exponha a porta 3000
EXPOSE 3000

# Comando para rodar a API
CMD ["npm", "start"]
