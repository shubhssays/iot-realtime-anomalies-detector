import { exec } from "child_process";

const commands = [
  `docker exec redpanda rpk topic create iot.telemetry -p 3`,
  `docker exec redpanda rpk topic create iot.anomalies -p 3`,
];

function main() {
  let completed = 0;
  const total = commands.length;

  for (const command of commands) {
    exec(command, (error, stdout, stderr) => {
      if (error) return console.error(`Exec error: ${error}`);
      if (stderr) console.error(`stderr: ${stderr}`);
      console.log(`stdout:\n${stdout}`);
      
      completed++;
      if (completed === total) {
        console.log("Kafka topic created successfully");
      }
    });
  }
}

main();
