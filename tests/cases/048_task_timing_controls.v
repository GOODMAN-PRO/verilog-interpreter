module tb;
  reg clock;
  integer signal_value, result, copy;
  task capture;
    input integer offset;
    output integer captured;
    begin
      @(posedge clock);
      #1 captured = signal_value + offset;
    end
  endtask
  task delayed_copy;
    input integer value;
    output integer copied;
    begin
      #2 copied = value;
    end
  endtask
  initial begin
    clock = 0;
    signal_value = 4;
    result = -1;
    copy = -1;
    fork
      begin capture(3, result); end
      begin #2 signal_value = 9; #1 clock = 1; end
    join
    $display("capture=%0d time=%0d", result, $time);
    fork
      begin delayed_copy(signal_value, copy); end
      begin #1 signal_value = 17; end
    join
    $display("copy=%0d signal=%0d time=%0d", copy, signal_value, $time);
    $finish;
  end
endmodule