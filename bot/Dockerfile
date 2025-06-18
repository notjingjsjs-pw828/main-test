FROM node:lts-buster

RUN apt-get update && \
    apt-get install -y build-essential clang python3 make g++ && \
    apt-get upgrade -y


RUN git clone https://github.com/NOTHING-MD420/project-test.git

# ورود به پوشه پروژه
WORKDIR /project-test/root/igNothing

RUN npm install && npm install -g pm2


COPY . .


EXPOSE 9090


CMD ["npm", "start"]