FROM node:13

WORKDIR /usr/src/app
copy . .
RUN npm install
RUN npm run compile

CMD ["npm", "start"]