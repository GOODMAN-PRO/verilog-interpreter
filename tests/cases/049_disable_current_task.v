module tb;
  integer calls, result;
  task find_first;
    input [7:0] value;
    output integer position;
    integer i;
    begin
      calls = calls + 1;
      position = -1;
      for (i = 0; i < 8; i = i + 1) begin
        if (value[i] === 1'b1) begin
          position = i;
          disable find_first;
        end
      end
      position = -2;
    end
  endtask
  initial begin
    calls = 0;
    find_first(8'b10110000, result);
    $display("first=%0d calls=%0d", result, calls);
    find_first(8'b00000000, result);
    $display("none=%0d calls=%0d", result, calls);
    find_first(8'b0000x010, result);
    $display("unknown=%0d calls=%0d", result, calls);
    $finish;
  end
endmodule