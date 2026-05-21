FROM node:22

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm install

COPY . .

RUN npm run build

# Kyunki code port 3000 use kar raha hai, hum Hugging Face ko bolte hain ke woh direct 3000 ko hi sunay!
EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0

CMD [ "npm", "start" ]
