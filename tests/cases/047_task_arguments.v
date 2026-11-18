module tb;
  integer shared, source, result, accumulated;
  task transform;
    input integer value;
    output integer doubled;
    inout integer sum;
    begin
      doubled = 2 * value;
      sum = sum + value;
      shared = shared + 1;
      value = -1;
    end
  endtask
  task ansi_task(input integer value, output integer result_value);
    begin
      result_value = value + shared;
      shared = shared + 10;
    end
  endtask
  initial begin
    shared = 0;
    source = 7;
    accumulated = 3;
    transform(source, result, accumulated);
    $display("source=%0d result=%0d accumulated=%0d shared=%0d", source, result, accumulated, shared);
    transform(-4, result, accumulated);
    $display("result=%0d accumulated=%0d shared=%0d", result, accumulated, shared);
    ansi_task(5, result);
    $display("ansi result=%0d shared=%0d", result, shared);
    $finish;
  end
endmodule