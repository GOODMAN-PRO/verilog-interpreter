`timescale 1ns/1ps
module moore(input clk, rst, request, release_request, output busy, done);
  localparam IDLE = 2'd0, WORK = 2'd1, DONE = 2'd2;
  reg [1:0] state, next;
  always @* begin
    next = state;
    case (state)
      IDLE: if (request) next = WORK;
      WORK: next = DONE;
      DONE: if (release_request) next = IDLE;
      default: next = IDLE;
    endcase
  end
  always @(posedge clk) if (rst) state <= IDLE; else state <= next;
  assign busy = state == WORK;
  assign done = state == DONE;
endmodule
module tb;
  reg clk, rst, request, release_request;
  wire busy, done;
  moore dut(clk, rst, request, release_request, busy, done);
  always #5 clk = ~clk;
  task step;
    input r, f;
    begin
      @(negedge clk); request = r; release_request = f;
      #1; $display("before request=%b release=%b busy=%b done=%b", r, f, busy, done);
      @(posedge clk); #1; $display("after state=%0d busy=%b done=%b", dut.state, busy, done);
    end
  endtask
  initial begin
    clk = 0; rst = 1; request = 0; release_request = 0;
    @(negedge clk); rst = 0;
    step(0, 0); step(1, 0); step(0, 0); step(0, 0);
    step(0, 1); step(1, 1); step(0, 0); step(0, 1);
    $finish;
  end
endmodule
