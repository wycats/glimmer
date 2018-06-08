#![allow(dead_code, unused_macros)]

use std::fmt;
use log::{self, Log, Record, Level, Metadata, SetLoggerError};

use wasm_bindgen;

use ffi;

// A `println!` macro that's redirected to `console.log` if debug assertions are
// enabled.
macro_rules! debug_println {
    ($($t:tt)*) => (::debug::_println(&format_args!($($t)*)))
}

// Override libstd's panic macro so we can hopefully get a better message by
// printing to the JS console. Note that this doesn't work for
// libstd-originating panics like `Option::unwrap`, those messages still won't
// make their way to the console, but hopefully a backtrace is good enough
// there!
macro_rules! panic {
    () => (panic!("explicit panic"));
    ($msg:expr) => (
        ::debug::_panic1(&($msg, file!(), line!()))
    );
    ($fmt:expr, $($arg:tt)*) => (
        ::debug::_panic2(&format_args!($fmt, $($arg)*), &(file!(), line!()))
    );
}

pub fn _println(a: &fmt::Arguments) {
    if !cfg!(debug_assertions) {
        return;
    }

    let s = a.to_string();
    ffi::println(&s);
}

#[cold]
#[inline(never)]
pub fn _panic1(&(msg, file, line): &(&'static str, &'static str, u32)) -> ! {
    debug_println!("rust panicked at: {}: {}:{}", msg, file, line);
    abort()
}

#[cold]
#[inline(never)]
pub fn _panic2(args: &fmt::Arguments, &(file, line): &(&str, u32)) -> ! {
    debug_println!("rust panicked at: {}: {}:{}", args, file, line);
    abort()
}

pub fn abort() -> ! {
    wasm_bindgen::throw("rust had to abort")
}

struct WasmLogger;

impl Log for WasmLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= log::max_level()
    }

    fn log(&self, record: &Record) {
        if self.enabled(record.metadata()) {
            let message = format!("{:?}", record.args());

            match record.metadata().level() {
                Level::Info => ffi::console_info(&message),
                Level::Warn => ffi::console_warn(&message),
                Level::Error => ffi::console_error(&message),
                Level::Trace | Level::Debug => ffi::console_debug(&message),
            }
        }
    }

    fn flush(&self) {}
}

static WASM_LOGGER: WasmLogger = WasmLogger;

#[wasm_bindgen()]
pub fn init_wasm_logger(level: &str) {
    log::set_logger(&WASM_LOGGER).unwrap();

    let filter = match level {
        "trace" => log::LevelFilter::Trace,
        "debug" => log::LevelFilter::Debug,
        "info" => log::LevelFilter::Info,
        "warn" => log::LevelFilter::Warn,
        "error" => log::LevelFilter::Error,
        "off" => log::LevelFilter::Off,
        _ => panic!("Initializing logger with invalid level filter {:?}", level)
    };

    log::set_max_level(filter);
}
