import { Signale } from "signale";

export class LoggingService {
  instance: Signale;

  constructor(scope: string) {
    const options = this.buildOptions(scope);
    this.instance = new Signale(options);
  }

  private buildOptions(scope: string) {
    const options = {
      interactive: true,
      scope: scope,
    };

    return options;
  }

  log(message: string) {
    this.instance.log(message);
  }

  warn(message: string) {
    this.instance.warn(message);
  }

  debug(message: string) {
    this.instance.debug(message);
  }

  info(message: string) {
    this.instance.info(message);
  }

  wait(message: string, ...args: any[]) {
    this.instance.await(message, ...args);
  }

  success(message: string, ...args: any[]) {
    this.instance.success(message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.instance.error(message, ...args);
  }
}
