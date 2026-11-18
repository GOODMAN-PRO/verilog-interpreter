module tb;
  reg signal;
  integer rises, falls;
  always @(posedge signal) rises = rises + 1;
  always @(negedge signal) falls = falls + 1;
  task drive;
    input next_value;
    begin
      signal = next_value;
      #1 $display("signal=%b rises=%0d falls=%0d", signal, rises, falls);
      #1;
    end
  endtask
  initial begin
    rises = 0;
    falls = 0;
    signal = 1'bx;
    #1;
    drive(1'b0);
    drive(1'b1);
    drive(1'bx);
    drive(1'b1);
    drive(1'bz);
    drive(1'b0);
    drive(1'bx);
    drive(1'bz);
    drive(1'b1);
    drive(1'b0);
    $finish;
  end
endmodule